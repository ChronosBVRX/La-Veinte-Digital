"use client"

import { useState, useCallback } from "react"
import type { ConditionalPayrollQuestion } from "../lib/question-engine"
import type { PayrollFact, PayrollFactKey } from "../lib/types"

export function usePayrollQuestions() {
  const [questions, setQuestions] = useState<ConditionalPayrollQuestion[]>([])
  const [answeredFacts, setAnsweredFacts] = useState<PayrollFact[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentQuestion = questions[currentIndex] ?? null
  const hasMore = currentIndex < questions.length - 1
  const isComplete = currentIndex >= questions.length && questions.length > 0

  const answer = useCallback((factKey: string, value: boolean | null) => {
    const fact: PayrollFact = {
      key: factKey as PayrollFactKey,
      value,
      source: "user",
      confidence: value === null ? 0.3 : 1.0,
      updatedAt: new Date().toISOString(),
    }
    setAnsweredFacts((prev) => {
      const filtered = prev.filter((f) => f.key !== factKey)
      return [...filtered, fact]
    })
    setCurrentIndex((prev) => prev + 1)
  }, [])

  const skipAll = useCallback(() => {
    setCurrentIndex(questions.length)
  }, [questions.length])

  const loadQuestions = useCallback((q: ConditionalPayrollQuestion[]) => {
    setQuestions(q)
    setCurrentIndex(0)
  }, [])

  const reset = useCallback(() => {
    setQuestions([])
    setAnsweredFacts([])
    setCurrentIndex(0)
  }, [])

  return {
    questions,
    currentQuestion,
    currentIndex,
    hasMore,
    isComplete,
    answeredFacts,
    answer,
    skipAll,
    loadQuestions,
    reset,
  }
}
