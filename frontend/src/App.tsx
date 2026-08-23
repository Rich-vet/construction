import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { FoundationPage } from './pages/FoundationPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FoundationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
