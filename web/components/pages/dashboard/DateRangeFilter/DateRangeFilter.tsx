"use client";

import { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { DateRangeId } from "@/components/types/dateRange.types";
import { useDateRange } from "@/components/hooks/useDateRange";
import {
  Wrapper,
  Trigger,
  ChevronIcon,
  Menu,
  MenuItem,
} from "./DateRangeFilter.styles";

interface DateRangeFilterProps {
  dateRange: ReturnType<typeof useDateRange>;
}

export default function DateRangeFilter({ dateRange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { options, selected, selectedOption, setSelected } = dateRange;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(id: DateRangeId) {
    setSelected(id);
    setIsOpen(false);
    // todo: include date picker modal for "custom" option

  }

  return (
    <Wrapper ref={wrapperRef}>
      <Trigger onClick={() => setIsOpen((prev) => !prev)} aria-haspopup="listbox" aria-expanded={isOpen}>
        <Icon icon="mdi:calendar-outline" width={18} height={18} />
        {selectedOption?.label}
        <ChevronIcon $isOpen={isOpen}>
          <Icon icon="mdi:chevron-down" width={18} height={18} />
        </ChevronIcon>
      </Trigger>

      {isOpen && (
        <Menu role="listbox">
          {options.map((option) => (
            <MenuItem
              key={option.id}
              $active={selected === option.id}
              role="option"
              aria-selected={selected === option.id}
              onClick={() => handleSelect(option.id)}
            >
              {option.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Wrapper>
  );
}