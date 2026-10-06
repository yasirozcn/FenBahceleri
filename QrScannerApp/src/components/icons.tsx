import Svg, { Path } from "react-native-svg";
import { colors } from "@/lib/config";

// Tasarım sistemindeki çizgi ikonlar (24×24, yuvarlak uçlu). Yalnızca görünüm içindir.
type IconProps = { size?: number; color?: string; strokeWidth?: number };

function make(d: string, defaultStroke = 2) {
  return function Icon({ size = 24, color = colors.ink, strokeWidth = defaultStroke }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <Path d={d} />
      </Svg>
    );
  };
}

export const IconBack = make("M15 5l-7 7 7 7", 2.2);
export const IconArrowRight = make("M5 12h14M13 6l6 6-6 6", 2.2);
export const IconCheck = make("M5 12.5l4.5 4.5L19 7", 3);
export const IconIn = make("M10 17l5-5-5-5M15 12H3M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4");
export const IconOut = make("M14 17l5-5-5-5M19 12H7M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4");
export const IconQr = make("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2");
export const IconBluetooth = make("M7 7l10 10-5 5V2l5 5L7 17");
export const IconBluetoothOff = make("M7 7l10 10-5 5V2l5 5L7 17M3 3l18 18");
export const IconInfo = make("M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 7.5v.01");
export const IconAlert = make("M12 3l9.5 17h-19zM12 10v4M12 17.5v.01");
export const IconX = make("M6 6l12 12M18 6L6 18", 2.6);
export const IconPhone = make("M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zM11 18h2");
export const IconShield = make("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5", 1.8);
export const IconMail = make("M3 6h18v12H3zM3 7l9 6 9-6", 1.8);
export const IconLogout = make("M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 00-2 2v12a2 2 0 002 2h6");
export const IconCamera = make("M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z");
