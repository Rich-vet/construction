"""Fictional Zambian worker demo accounts."""

from __future__ import annotations

from sqlalchemy import func, select

from app.extensions import db
from app.models import User
from app.seed_workers import WORKER_DEMO_PASSWORD, WORKER_NAMES, seed_zambian_workers, worker_email
from app.utils.roles import CONTRACTOR_WORKER
from tests.conftest import login


def test_worker_dataset_has_forty_unique_emails():
    emails = [worker_email(index) for index in range(1, len(WORKER_NAMES) + 1)]
    assert len(WORKER_NAMES) == 40
    assert len(emails) == 40
    assert len(set(emails)) == 40
    assert emails[0] == "worker01@ccms-demo.local"
    assert emails[-1] == "worker40@ccms-demo.local"


def test_seed_is_idempotent_and_hashes_password(app, client):
    with app.app_context():
        from app.models import ProjectMember, Task

        existing = list(
            db.session.scalars(select(User).where(User.email.like("worker%@ccms-demo.local")))
        )
        ids = [user.id for user in existing]
        if ids:
            db.session.query(Task).filter(Task.assigned_user_id.in_(ids)).delete(synchronize_session=False)
            db.session.query(ProjectMember).filter(ProjectMember.user_id.in_(ids)).delete(
                synchronize_session=False
            )
            db.session.query(User).filter(User.id.in_(ids)).delete(synchronize_session=False)
            db.session.commit()
            db.session.expunge_all()

        first = seed_zambian_workers()
        count = db.session.scalar(
            select(func.count()).select_from(User).where(User.email.like("worker%@ccms-demo.local"))
        )
        sample = db.session.scalar(select(User).where(User.email == "worker01@ccms-demo.local"))
        assert sample is not None
        assert sample.role_name == CONTRACTOR_WORKER
        assert sample.is_active is True
        assert sample.full_name == "Chanda Mwila"
        assert sample.password_hash != WORKER_DEMO_PASSWORD
        assert sample.check_password(WORKER_DEMO_PASSWORD)
        stored_hash = sample.password_hash

        second = seed_zambian_workers()
        again = db.session.scalar(
            select(func.count()).select_from(User).where(User.email.like("worker%@ccms-demo.local"))
        )
        sample = db.session.scalar(select(User).where(User.email == "worker01@ccms-demo.local"))

    assert first["failed"] == 0
    assert first["created"] == 40
    assert count == 40
    assert second["created"] == 0
    assert second["skipped"] == 40
    assert again == 40
    assert sample.password_hash == stored_hash

    logged_in = login(client, "worker08@ccms-demo.local", WORKER_DEMO_PASSWORD)
    assert logged_in.status_code == 200
    body = logged_in.get_json()
    user = body.get("user") or body
    assert user["role"] == CONTRACTOR_WORKER
    assert "password" not in user
    assert "password_hash" not in user


def test_existing_demo_email_is_not_reset(app):
    with app.app_context():
        seed_zambian_workers()
        user = db.session.scalar(select(User).where(User.email == "worker02@ccms-demo.local"))
        user.set_password("ChangedPass1")
        db.session.commit()
        seed_zambian_workers()
        user = db.session.scalar(select(User).where(User.email == "worker02@ccms-demo.local"))
        assert user.check_password("ChangedPass1")
        assert not user.check_password(WORKER_DEMO_PASSWORD)
