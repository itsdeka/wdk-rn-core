/**
 * Custom hook for managing IntroCarousel animation state and logic.
 *
 * Handles:
 * - Slide navigation (forward/backward)
 * - Auto-advance timer management
 * - Progress bar animation
 * Simplified version without Rive dependency.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/utils/logger';

const introCarouselLogger = createLogger('IntroCarousel');
export const AUTO_ADVANCE_DURATION = 10000; // 10 seconds

export interface IntroCarouselSlide {
  id: number;
  titleTx: string;
  descriptionTx: string;
}

export interface UseIntroCarouselAnimationParams {
  slides: IntroCarouselSlide[];
  onFinish?: () => void;
}

export interface UseIntroCarouselAnimationReturn {
  // State
  currentIndex: number;
  isAnimating: boolean;

  // Actions
  goToNext: () => void;
  goToPrevious: () => void;
}

export const useIntroCarouselAnimation = ({
  slides,
  onFinish,
}: UseIntroCarouselAnimationParams): UseIntroCarouselAnimationReturn => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goToNextRef = useRef<(() => void) | undefined>(undefined);

  // Stop auto-advance
  const stopAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  // Go to next slide or finish
  const goToNext = useCallback(() => {
    // Block if already animating
    if (isAnimating) {
      introCarouselLogger.debug('Navigation blocked: already animating');
      return;
    }

    if (currentIndex >= slides.length - 1) {
      // Last slide - call onFinish
      stopAutoAdvance();
      if (onFinish) {
        onFinish();
      }
      return;
    }

    introCarouselLogger.debug('Starting navigation to slide', { nextIndex: currentIndex + 1 });

    stopAutoAdvance();
    setIsAnimating(true);

    // Update currentIndex to move to next slide
    setCurrentIndex((prev) => prev + 1);

    // Re-enable after animation completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  }, [currentIndex, isAnimating, onFinish, slides.length, stopAutoAdvance]);

  // Update ref when goToNext changes
  useEffect(() => {
    goToNextRef.current = goToNext;
  }, [goToNext]);

  // Start auto-advance timer
  const startAutoAdvance = useCallback(() => {
    // Clear any existing timer
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }

    // Set timer to advance to next slide
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (goToNextRef.current) {
        goToNextRef.current();
      }
    }, AUTO_ADVANCE_DURATION);
  }, []);

  // Go to previous slide
  const goToPrevious = useCallback(() => {
    // Block if already animating or at first slide
    if (isAnimating || currentIndex <= 0) {
      introCarouselLogger.debug('Navigation blocked', { isAnimating, currentIndex });
      return;
    }

    introCarouselLogger.debug('Starting navigation to slide', { nextIndex: currentIndex - 1 });

    stopAutoAdvance();
    setIsAnimating(true);

    // Update currentIndex to move to previous slide
    setCurrentIndex((prev) => prev - 1);

    // Re-enable after animation completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  }, [currentIndex, isAnimating, stopAutoAdvance]);

  // Start auto-advance when component mounts or index changes
  useEffect(() => {
    startAutoAdvance();
  }, [currentIndex, startAutoAdvance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  return {
    // State
    currentIndex,
    isAnimating,

    // Actions
    goToNext,
    goToPrevious,
  };
};

