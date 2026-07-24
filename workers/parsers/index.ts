/** 파서 레지스트리 — source → 파서 매핑 (docs/SPEC.md §6.2) */
import type { WholesaleSource } from "../lib/types";
import type { WholesaleParser } from "./types";
import { gonyb2bParser } from "./gonyb2b";
import { ggsanParser } from "./ggsan";
import { upickb2bParser } from "./upickb2b";

export const PARSERS: Record<WholesaleSource, WholesaleParser> = {
  gonyb2b: gonyb2bParser,
  ggsan: ggsanParser,
  upickb2b: upickb2bParser,
};

export const ALL_SOURCES = Object.keys(PARSERS) as WholesaleSource[];
