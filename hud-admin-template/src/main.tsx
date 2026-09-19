import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider } from './store/DataContext'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <DataProvider>
                <App />
            </DataProvider>
        </ThemeProvider>
    </StrictMode>,
)
