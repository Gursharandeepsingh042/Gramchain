import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated'
import Svg, { Circle, Path, G } from 'react-native-svg'
import { colors } from '@/constants/colors'
import { shadows } from '@/constants/design'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface Props {
  score:    number | null
  showLabel?: boolean
}

const MIN_SCORE = 300
const MAX_SCORE = 900

// Map score to descriptive label
const getScoreLabel = (s: number) => {
  if (s >= 750) return { label: 'उत्कृष्ट / Excellent', color: colors.score.excellent }
  if (s >= 650) return { label: 'अच्छा / Good',          color: colors.score.good }
  if (s >= 500) return { label: 'ठीक / Fair',            color: colors.score.fair }
  return              { label: 'कमज़ोर / Poor',           color: colors.score.poor }
}

export const CreditScoreGauge = ({ score, showLabel = true }: Props) => {
  const progress    = useSharedValue(0)
  const scoreNumber = useSharedValue(0)
  const opacity     = useSharedValue(0)

  const SIZE        = 220
  const STROKE_W    = 18
  const R           = (SIZE - STROKE_W) / 2
  const CIRCUMF     = 2 * Math.PI * R
  const ARC_LENGTH  = CIRCUMF * 0.75       // 270° arc

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 })

    if (score && score > 0) {
      const ratio = Math.max(0, Math.min((score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE), 1))
      progress.value    = withDelay(200, withTiming(ratio, {
        duration: 1800,
        easing:   Easing.out(Easing.cubic),
      }))
      scoreNumber.value = withDelay(200, withTiming(score, {
        duration: 1800,
        easing:   Easing.out(Easing.cubic),
      }))
    } else {
      progress.value    = withTiming(0, { duration: 400 })
      scoreNumber.value = withTiming(0,  { duration: 400 })
    }
  }, [score])

  // Animated arc stroke-dashoffset
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH - progress.value * ARC_LENGTH,
    stroke: interpolateColor(
      progress.value,
      [0,    0.33,            0.575,           1],
      ['#dc2626', '#f59e0b', '#22c55e', '#16a34a']
    ),
  }))

  // Animated score number display
  const scoreStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const displayScore = score ?? 0
  const scoreInfo    = score ? getScoreLabel(score) : null

  // Gauge arc path — rotated 135° from bottom-left
  const startAngle = 135 * (Math.PI / 180)
  const cx = SIZE / 2, cy = SIZE / 2

  return (
    <Animated.View style={[styles.container, scoreStyle]}>
      <View style={styles.svgWrapper}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track arc */}
          <Circle
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={colors.gray[100]}
            strokeWidth={STROKE_W}
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMF}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(135, ${cx}, ${cy})`}
          />
          {/* Filled arc */}
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            strokeWidth={STROKE_W}
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMF}`}
            strokeLinecap="round"
            transform={`rotate(135, ${cx}, ${cy})`}
            animatedProps={arcProps}
          />

          {/* Score markers */}
          {[300, 500, 650, 750, 900].map((mark, i) => {
            const ratio   = (mark - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)
            const angle   = (135 + ratio * 270) * (Math.PI / 180)
            const x1      = cx + (R - STROKE_W / 2 - 4) * Math.cos(angle)
            const y1      = cy + (R - STROKE_W / 2 - 4) * Math.sin(angle)
            const x2      = cx + (R + STROKE_W / 2 + 4) * Math.cos(angle)
            const y2      = cy + (R + STROKE_W / 2 + 4) * Math.sin(angle)
            return (
              <Path
                key={mark}
                d={`M ${x1} ${y1} L ${x2} ${y2}`}
                stroke={colors.gray[300]}
                strokeWidth={1.5}
              />
            )
          })}
        </Svg>

        {/* Center Content */}
        <View style={styles.centerContent}>
          <Text style={styles.scorePre}>आपका स्कोर</Text>
          <Text style={[
            styles.scoreText,
            { color: scoreInfo?.color ?? colors.gray[300] }
          ]}>
            {score ? Math.round(displayScore) : '---'}
          </Text>
          {scoreInfo && (
            <View style={[styles.scoreLabelPill, { backgroundColor: `${scoreInfo.color}18` }]}>
              <Text style={[styles.scoreLabelText, { color: scoreInfo.color }]}>
                {scoreInfo.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Score Range Legend */}
      {showLabel && (
        <View style={styles.legend}>
          {[
            { label: '300–499', color: colors.score.poor,      badge: 'Poor' },
            { label: '500–649', color: colors.score.fair,      badge: 'Fair' },
            { label: '650–749', color: colors.score.good,      badge: 'Good' },
            { label: '750+',    color: colors.score.excellent, badge: 'Excellent' },
          ].map((item) => (
            <View key={item.badge} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.badge}</Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    paddingVertical: 8,
  },
  svgWrapper: {
    position:       'relative',
    alignItems:     'center',
    justifyContent: 'center',
  },
  centerContent: {
    position:  'absolute',
    alignItems: 'center',
    top:        '30%',
  },
  scorePre: {
    fontSize:   11,
    color:      colors.gray[500],
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  scoreText: {
    fontSize:    48,
    fontWeight:  '900',
    letterSpacing: -2,
    lineHeight:   52,
  },
  scoreLabelPill: {
    marginTop:        8,
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderRadius:     20,
  },
  scoreLabelText: {
    fontSize:   12,
    fontWeight: '700',
  },

  // Legend
  legend: {
    flexDirection:  'row',
    marginTop:      12,
    gap:            16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  legendText: {
    fontSize:  11,
    color:     colors.gray[600],
    fontWeight: '500',
  },
})
