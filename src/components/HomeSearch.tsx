"use client";

import { useRouter } from "next/navigation";
import { SearchBox } from "@/components/SearchBox";
import { zoneUrl } from "@/lib/geometry";

export function HomeSearch() {
  const router = useRouter();
  return <SearchBox onSelect={(p) => router.push(zoneUrl("/analyze", { lat: p.lat, lng: p.lng, label: p.label }))} />;
}
