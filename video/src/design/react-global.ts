import * as React from 'react'
import * as ReactDOM from 'react-dom'

// design/components/bundle.js reads window.React when it loads, so this file
// is imported before it
const host = window as unknown as { React: typeof React; ReactDOM: typeof ReactDOM }
host.React = React
host.ReactDOM = ReactDOM
