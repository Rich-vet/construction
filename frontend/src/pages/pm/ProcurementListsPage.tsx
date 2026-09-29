import { useEffect, useState } from 'react'
import { Alert, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { FilterTabs, PageHero } from '../../components/ui/PageChrome'
import { ApiError } from '../../api/auth'
import {
  fetchDeliveries,
  fetchPurchaseOrders,
  fetchQuotations,
} from '../../api/projects'

type Tab = 'quotations' | 'orders' | 'deliveries'

function projectLink(projectId: unknown) {
  if (!projectId) return null
  return `/projects/${projectId}?tab=procurement`
}

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
    <AppShell>
      <PageHero
        title="Procurement queue"
        subtitle="Cross-project overview. Create quotations, POs, and deliveries in the project workspace."
      />

      <div className="panel-card">
        <FilterTabs
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: 'quotations', label: 'Quotations' },
            { value: 'orders', label: 'Purchase orders' },
            { value: 'deliveries', label: 'Deliveries' },
          ]}
        />

        <p className="empty-hint mb-3">
          This list is a queue only. Open a project to run the authoritative procurement workflow.
        </p>

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {loading ? (
          <div className="loading-state">
            <Spinner animation="border" />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-panel">
            <p>No {tab} found for your projects.</p>
            <Link to="/projects" className="btn btn-primary">
              Open Projects
            </Link>
          </div>
        ) : (
          <Table responsive hover className="mb-0 data-table">
            <thead>
              <tr>
                <th>Project</th>
                {tab === 'quotations' ? (
                  <>
                    <th>Supplier</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Total (K)</th>
                    <th>Selected</th>
                  </>
                ) : null}
                {tab === 'orders' ? (
                  <>
                    <th>Supplier</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Expected</th>
                  </>
                ) : null}
                {tab === 'deliveries' ? (
                  <>
                    <th>Material</th>
                    <th>Qty received</th>
                    <th>Date</th>
                    <th>Received by</th>
                  </>
                ) : null}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const href = projectLink(row.project_id)
                return (
                  <tr key={String(row.id)}>
                    <td>{String(row.project_name)}</td>
                    {tab === 'quotations' ? (
                      <>
                        <td>{String(row.supplier_name)}</td>
                        <td>{String(row.material_name)}</td>
                        <td>{String(row.quantity)}</td>
                        <td>{Number(row.total_price).toLocaleString()}</td>
                        <td>{row.is_selected ? 'Yes' : 'No'}</td>
                      </>
                    ) : null}
                    {tab === 'orders' ? (
                      <>
                        <td>{String(row.supplier_name)}</td>
                        <td>{String(row.material_name)}</td>
                        <td>{String(row.quantity)}</td>
                        <td>{String(row.status)}</td>
                        <td>{String(row.expected_delivery ?? '—')}</td>
                      </>
                    ) : null}
                    {tab === 'deliveries' ? (
                      <>
                        <td>{String(row.material_name)}</td>
                        <td>{String(row.quantity_received)}</td>
                        <td>{String(row.delivery_date)}</td>
                        <td>{String(row.received_by_name ?? '—')}</td>
                      </>
                    ) : null}
                    <td>
                      {href ? (
                        <Link to={href} className="btn btn-sm btn-outline-secondary">
                          Open workflow
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </div>
    </AppShell>
  )
}
