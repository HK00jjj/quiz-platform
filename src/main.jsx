import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './theme/global.css'
import './theme/pages.css'
/* 糖果主题层：必须排在 gothic 两份 CSS 之后，靠层叠顺序覆盖（同特异性时后来者胜） */
import './theme/candy.css'

createRoot(document.getElementById('root')).render(<App />)
