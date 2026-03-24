import Image from "next/image";

export type Props = {};

export default function Icon(_: Props) {
  return <Image src="/icon.svg" alt="GovClerkMinutes icon" width={40} height={40} priority />;
}
