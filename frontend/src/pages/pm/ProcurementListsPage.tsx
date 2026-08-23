import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { AppShell } from '../../components/layout/AppShell'
import { ApiError } from '../../api/auth'
import {
  fetchDeliveries,
  fetchPurchaseOrders,
  fetchQuotations,
} from '../../api/projects'

type Tab = 'quotations' | 'orders' | 'deliveries'

export function ProcurementListsPage({ initialTab = 'quotations' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const loader =
      tab === 'quotations'
        ? fetchQuotations
        : tab === 'orders'
          ? fetchPurchaseOrders
          : fetchDeliveries
    loader()
      .then((data) => setItems(data.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load procurement data.'),
      )
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <AppShell breadcrumb="Procurement" title="Procurement overview" phaseLabel="PM">
      <div className="page-toolbar mb-3">
        <div className="btn-group">
          {(
            [
              ['quotations', 'Quotations'],
              ['orders', 'Purchase orders'],
              ['deliveries', 'Deliveries'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-muted">
        Create and manage procurement steps from a project workspace. This page lists records across
        your projects.
      </p>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="loading-state">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-panel">
          <p>No {tab} found for your projects.</p>
        </div>
      ) : (
        <div className="table-panel">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                {tab === 'quotations' ? (
                  <>
                    <th>Project</th>
                    <th>Supplier</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Total (K)</th>
                    <th>Selected</th>
                  </>
                ) : null}
                {tab === 'orders' ? (
                  <>
                    <th>Project</th>
                    <th>Supplier</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Expected</th>
                  </>
                ) : null}
                {tab === 'deliveries' ? (
                  <>
                    <th>Project</th>
                    <th>Material</th>
                    <th>Qty received</th>
                    <th>Date</th>
                    <th>Received by</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={String(row.id)}>
                  {tab === 'quotations' ? (
                    <>
                      <td>{String(row.project_name)}</td>
                      <td>{String(row.supplier_name)}</td>
                      <td>{String(row.material_name)}</td>
                      <td>{String(row.quantity)}</td>
                      <td>{Number(row.total_price).toLocaleString()}</td>
                      <td>{row.is_selected ? 'Yes' : 'No'}</td>
                    </>
                  ) : null}
                  {tab === 'orders' ? (
                    <>
                      <td>{String(row.project_name)}</td>
                      <td>{String(row.supplier_name)}</td>
                      <td>{String(row.material_name)}</td>
                      <td>{String(row.quantity)}</td>
                      <td>{String(row.status)}</td>
                      <td>{String(row.expected_delivery ?? '—')}</td>
                    </>
                  ) : null}
                  {tab === 'deliveries' ? (
                    <>
                      <td>{String(row.project_name)}</td>
                      <td>{String(row.material_name)}</td>
                      <td>{String(row.quantity_received)}</td>
                      <td>{String(row.delivery_date)}</td>
                      <td>{String(row.received_by_name ?? '—')}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
