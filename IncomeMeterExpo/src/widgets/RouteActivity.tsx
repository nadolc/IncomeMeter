// Live Activity for a route in progress (Lock Screen + Dynamic Island). iOS only.
// The layout runs in the widget's own runtime: it may only use its props and @expo/ui/swift-ui – every word
// shown (in the app's language) comes in through props. Started / updated / ended by ./liveActivity.ts.
import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type RouteActivityProps = {
  title: string;
  /** SF Symbol for the travel mode: car.fill, bicycle, figure.walk … */
  symbol: string;
  startedAtMs: number;
  distance: string;
  stopsCount: number;
  stopsWord: string;
  elapsedLabel: string;
  distanceLabel: string;
  recordLabel: string;
  /** Final state shown for a few minutes after the route ends. */
  ended: boolean;
  endedText: string;
};

const RouteActivity = (props: RouteActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#1F6FEB';
  const started = new Date(props.startedAtMs);
  const stops = `${props.stopsCount} ${props.stopsWord}`;

  return {
    banner: (
      <VStack modifiers={[padding({ all: 14 })]}>
        <HStack>
          <Image systemName={props.symbol as never} color={accent} />
          <Text modifiers={[font({ weight: 'semibold', size: 15 })]}>{props.title}</Text>
          <Spacer />
          {props.ended
            ? <Text modifiers={[font({ size: 13 })]}>{props.endedText}</Text>
            : <Text date={started} dateStyle="timer" modifiers={[font({ size: 15 }), monospacedDigit()]} />}
        </HStack>
        <HStack>
          <Text modifiers={[font({ weight: 'bold', size: 26 }), monospacedDigit()]}>{props.distance}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 15 }), foregroundStyle('#8E8E93')]}>{stops}</Text>
        </HStack>
        {props.ended ? null : (
          <Button
            label={props.recordLabel}
            target="record-stop"
            onPress={() => ({ ...props, stopsCount: props.stopsCount + 1 })}
          />
        )}
      </VStack>
    ),
    compactLeading: <Image systemName={props.symbol as never} color={accent} />,
    compactTrailing: <Text modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>{props.distance}</Text>,
    minimal: <Image systemName={props.symbol as never} color={accent} />,
    expandedLeading: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#8E8E93')]}>{props.elapsedLabel}</Text>
        <Text date={started} dateStyle="timer" modifiers={[font({ weight: 'bold', size: 18 }), monospacedDigit()]} />
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#8E8E93')]}>{props.distanceLabel}</Text>
        <Text modifiers={[font({ weight: 'bold', size: 18 }), monospacedDigit()]}>{props.distance}</Text>
      </VStack>
    ),
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 8 })]}>
        <Text modifiers={[font({ size: 14 })]}>{stops}</Text>
        <Spacer />
        {props.ended ? null : (
          <Button
            label={props.recordLabel}
            target="record-stop"
            onPress={() => ({ ...props, stopsCount: props.stopsCount + 1 })}
          />
        )}
      </HStack>
    ),
  };
};

export default createLiveActivity<RouteActivityProps>('RouteActivity', RouteActivity);
