import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable.css'
import './index.css'
import App from './App.tsx'
import { ApiProvider } from './api/ApiProvider'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider } from './store/DataContext'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ApiProvider>
            <ThemeProvider>
                <DataProvider>
                    <App />
                </DataProvider>
            </ThemeProvider>
        </ApiProvider>
    </StrictMode>,
)
