import type { PayrollRule } from "../types"
import { rule002 } from "./concept-002"
import { rule011 } from "./concept-011"
import { rule020 } from "./concept-020"
import { rule022 } from "./concept-022"
import { concept02Rule } from "./concept-02"
import { concept012Rule } from "./concept-012"
import { concept013Rule } from "./concept-013"
import { concept051Rule } from "./concept-051"
import { rule054 } from "./concept-054"
import { rule055 } from "./concept-055"
import { concept057Rule } from "./concept-057"
import { concept058Rule } from "./concept-058"
import { concept061Rule } from "./concept-061"
import { concept062Rule } from "./concept-062"
import { concept072Rule } from "./concept-072"
import { concept078Rule } from "./concept-078"
import { concept083Rule } from "./concept-083"
import { rule050 } from "./concept-050"

export {
  rule002, rule011, rule020, rule022,
  concept02Rule as rule02,
  concept012Rule as rule012,
  concept013Rule as rule013,
  concept051Rule as rule051,
  rule054, rule055, rule050,
  concept057Rule as rule057,
  concept058Rule as rule058,
  concept061Rule as rule061,
  concept062Rule as rule062,
  concept072Rule as rule072,
  concept078Rule as rule078,
  concept083Rule as rule083,
}

export function getAllRules(): PayrollRule[] {
  return [
    rule002, rule011, rule020, rule022,
    rule054, rule055, rule050,
    concept02Rule, concept012Rule, concept013Rule, concept051Rule,
    concept057Rule, concept058Rule, concept061Rule, concept062Rule,
    concept072Rule, concept078Rule, concept083Rule,
  ]
}
