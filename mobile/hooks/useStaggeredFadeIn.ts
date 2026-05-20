import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'

interface Options {
  /** Number of animated values to create. */
  count: number
  /** Delay between each spring start (ms). Default 120. */
  stagger?: number
  /** Spring friction. Default 8. */
  friction?: number
  /** Spring tension. Default 60. */
  tension?: number
  /** If true, restart anims when `key` changes. */
  resetKey?: string | number
}

/**
 * Returns an array of `Animated.Value`s and runs a staggered spring entrance
 * (0 → 1) on mount. Use the helper `makeFadeStyle(anim)` to apply to views.
 *
 * Example:
 * ```tsx
 * const [headerAnim, formAnim] = useStaggeredFadeIn({ count: 2 })
 * <Animated.View style={[styles.header, makeFadeStyle(headerAnim)]} />
 * ```
 */
export function useStaggeredFadeIn({
  count,
  stagger = 120,
  friction = 8,
  tension = 60,
  resetKey,
}: Options): Animated.Value[] {
  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current

  useEffect(() => {
    anims.forEach(a => a.setValue(0))
    Animated.stagger(
      stagger,
      anims.map(a =>
        Animated.spring(a, {
          toValue: 1,
          friction,
          tension,
          useNativeDriver: true,
        }),
      ),
    ).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  return anims
}

/**
 * Returns an `Animated` style that fades + slides a view up as `anim` 0→1.
 */
export const makeFadeStyle = (
  anim: Animated.Value,
  translate: number = 24,
) => ({
  opacity: anim,
  transform: [
    {
      translateY: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [translate, 0],
      }),
    },
  ],
})
