import React, { useEffect, useState } from "react";
import {
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Tag,
  TagCloseButton,
  TagLabel,
  HStack,
  Text,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from "@chakra-ui/react";
import type { FilterDefinition } from "./types";

type Op = "<" | "<=" | "==" | ">=" | ">";

const opToSymbol: Record<Op, string> = {
  "<": "<",
  "<=": "≤",
  "==": "=",
  ">=": "≥",
  ">": ">",
};

const MessageCount: FilterDefinition<{ op: Op; count: number }> = {
  type: "messageCount",
  addLabel: "Message count",
  defaultValue: () => ({ op: ">=", count: 10 }),
  formatLabel: (v) => `Messages ${opToSymbol[v.op]} ${v.count}`,
  Pill: ({ value, onRemove }) => (
    <Tag
      size="lg"
      borderRadius="full"
      cursor="pointer"
      data-filter-pill
      onClick={(e) => e.stopPropagation()}
    >
      <TagLabel>{`Messages ${opToSymbol[value.op]} ${value.count}`}</TagLabel>
      <TagCloseButton
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </Tag>
  ),
  Editor: ({ value, onChange }) => {
    const [op, setOp] = useState<Op>(value?.op ?? ">=");
    const [count, setCount] = useState<number>(value?.count ?? 10);

    useEffect(() => {
      setOp((value?.op as Op) ?? ">=");
      setCount(Number(value?.count ?? 10));
    }, [value?.op, value?.count]);

    return (
      <PopoverContent w="sm" onClick={(e) => e.stopPropagation()}>
        <PopoverArrow />
        <PopoverBody>
          <HStack spacing={3} align="center">
            <Text minW="120px">Message count</Text>
            <Select
              value={op}
              onChange={(e) => {
                const nextOp = e.target.value as Op;
                setOp(nextOp);
                onChange({ op: nextOp, count });
              }}
              w="auto"
            >
              <option value="<">&lt;</option>
              <option value="<=">≤</option>
              <option value="==">=</option>
              <option value=">=">≥</option>
              <option value=">">&gt;</option>
            </Select>
            <NumberInput
              value={Number.isFinite(count) ? count : 0}
              min={0}
              step={1}
              w="28"
              onChange={(valStr, valNum) => {
                const v = Number.isFinite(valNum) ? Math.max(0, Math.floor(valNum)) : 0;
                setCount(v);
                onChange({ op, count: v });
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </HStack>
        </PopoverBody>
      </PopoverContent>
    );
  },
  toJSON: (v) => ({ op: v.op, count: Number(v.count) }),
  fromJSON: (raw) => {
    const r = raw as any;
    const allowed: Op[] = ["<", "<=", "==", ">=", ">"];
    const op: Op = allowed.includes(r?.op) ? r.op : ">=";
    const count = Math.max(0, Number(r?.count ?? 10));
    return { op, count };
  },
};

export default MessageCount;
