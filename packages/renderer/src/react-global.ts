import * as React from 'react'
import * as ReactDOM from 'react-dom/client'

// design/components/bundle.js reads window.React when it loads, so this file
// must be imported before it
const host = window as unknown as { React: typeof React; ReactDOM: typeof ReactDOM }
host.React = React
host.ReactDOM = ReactDOM
