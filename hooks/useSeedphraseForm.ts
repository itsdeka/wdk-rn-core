import { useState } from 'react'

export function useSeedphraseForm() {
  const [showSeedphraseInput, setShowSeedphraseInput] = useState(false)
  const [seedphrase, setSeedphrase] = useState('')
  const [seedphraseError, setSeedphraseError] = useState<string | null>(null)

  const openSeedphraseInput = () => {
    setShowSeedphraseInput(true)
    setSeedphrase('')
    setSeedphraseError(null)
  }

  const closeSeedphraseInput = () => {
    setShowSeedphraseInput(false)
    setSeedphrase('')
    setSeedphraseError(null)
  }

  const updateSeedphrase = (text: string) => {
    setSeedphrase(text)
    setSeedphraseError(null)
  }

  const setError = (error: string | null) => {
    setSeedphraseError(error)
  }

  const reset = () => {
    setShowSeedphraseInput(false)
    setSeedphrase('')
    setSeedphraseError(null)
  }

  return {
    showSeedphraseInput,
    seedphrase,
    seedphraseError,
    openSeedphraseInput,
    closeSeedphraseInput,
    updateSeedphrase,
    setError,
    reset,
  }
}

