import { useState } from 'react'

export function useTipJarForm() {
  const [showCreateTipJar, setShowCreateTipJar] = useState(false)
  const [tipJarIdentifier, setTipJarIdentifier] = useState('')
  const [tipJarName, setTipJarName] = useState('')
  const [tipJarError, setTipJarError] = useState<string | null>(null)

  const openCreateTipJar = () => {
    setShowCreateTipJar(true)
    setTipJarIdentifier('')
    setTipJarName('')
    setTipJarError(null)
  }

  const closeCreateTipJar = () => {
    setShowCreateTipJar(false)
    setTipJarIdentifier('')
    setTipJarName('')
    setTipJarError(null)
  }

  const updateIdentifier = (text: string) => {
    setTipJarIdentifier(text)
    setTipJarError(null)
  }

  const updateName = (text: string) => {
    setTipJarName(text)
    setTipJarError(null)
  }

  const setError = (error: string | null) => {
    setTipJarError(error)
  }

  const reset = () => {
    setShowCreateTipJar(false)
    setTipJarIdentifier('')
    setTipJarName('')
    setTipJarError(null)
  }

  return {
    showCreateTipJar,
    tipJarIdentifier,
    tipJarName,
    tipJarError,
    openCreateTipJar,
    closeCreateTipJar,
    updateIdentifier,
    updateName,
    setError,
    reset,
  }
}

