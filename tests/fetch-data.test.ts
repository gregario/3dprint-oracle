import { describe, it, expect } from 'vitest';
import {
  parseManufacturerFile,
  type RawManufacturerFile,
} from '../scripts/fetch-data.js';

const SAMPLE: RawManufacturerFile = {
  manufacturer: 'TestCo',
  filaments: [
    {
      name: '{color_name}',
      material: 'PLA',
      density: 1.24,
      weights: [{ weight: 1000, spool_weight: 250 }],
      diameters: [1.75],
      extruder_temp: 210,
      colors: [
        { name: 'Red', hex: 'FF0000' },
        { name: 'Blue', hex: '0000FF' },
      ],
    },
  ],
};

describe('parseManufacturerFile', () => {
  it('expands filaments into one row per color x diameter x weight', () => {
    const rows = parseManufacturerFile(SAMPLE);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Red');
    expect(rows[0].manufacturer).toBe('TestCo');
    expect(rows[0].material).toBe('PLA');
    expect(rows[0].color_hex).toBe('FF0000');
    expect(rows[1].name).toBe('Blue');
  });

  it('expands multiple diameters', () => {
    const multi = {
      ...SAMPLE,
      filaments: [
        {
          ...SAMPLE.filaments[0],
          diameters: [1.75, 2.85],
        },
      ],
    };
    const rows = parseManufacturerFile(multi);
    expect(rows).toHaveLength(4); // 2 colors x 2 diameters
  });

  it('expands multiple weights', () => {
    const multi = {
      ...SAMPLE,
      filaments: [
        {
          ...SAMPLE.filaments[0],
          weights: [
            { weight: 500, spool_weight: 200 },
            { weight: 1000, spool_weight: 250 },
          ],
        },
      ],
    };
    const rows = parseManufacturerFile(multi);
    expect(rows).toHaveLength(4); // 2 colors x 1 diameter x 2 weights
  });

  it('handles temp ranges', () => {
    const withRange = {
      ...SAMPLE,
      filaments: [
        {
          ...SAMPLE.filaments[0],
          extruder_temp_range: [190, 230] as [number, number],
          bed_temp_range: [50, 70] as [number, number],
        },
      ],
    };
    const rows = parseManufacturerFile(withRange);
    expect(rows[0].extruder_temp_min).toBe(190);
    expect(rows[0].extruder_temp_max).toBe(230);
    expect(rows[0].bed_temp_min).toBe(50);
    expect(rows[0].bed_temp_max).toBe(70);
  });

  it('uses single temp as min/max when no range provided', () => {
    const rows = parseManufacturerFile(SAMPLE);
    expect(rows[0].extruder_temp).toBe(210);
    expect(rows[0].extruder_temp_min).toBe(210);
    expect(rows[0].extruder_temp_max).toBe(210);
  });

  it('replaces {color_name} in filament name', () => {
    const named = {
      ...SAMPLE,
      filaments: [
        {
          ...SAMPLE.filaments[0],
          name: 'TestCo PLA {color_name}',
        },
      ],
    };
    const rows = parseManufacturerFile(named);
    expect(rows[0].name).toBe('TestCo PLA Red');
  });

  it('handles optional fields: finish, translucent, glow', () => {
    const withOptional = {
      ...SAMPLE,
      filaments: [
        {
          ...SAMPLE.filaments[0],
          finish: 'matte',
          translucent: true,
          glow: true,
        },
      ],
    };
    const rows = parseManufacturerFile(withOptional);
    expect(rows[0].finish).toBe('matte');
    expect(rows[0].translucent).toBe(true);
    expect(rows[0].glow).toBe(true);
  });

  it('defaults optional fields to null/false', () => {
    const rows = parseManufacturerFile(SAMPLE);
    expect(rows[0].finish).toBeNull();
    expect(rows[0].translucent).toBe(false);
    expect(rows[0].glow).toBe(false);
  });

  it('handles filament with no colors (colorless)', () => {
    const noColors = {
      ...SAMPLE,
      filaments: [
        {
          ...SAMPLE.filaments[0],
          colors: undefined as any,
        },
      ],
    };
    const rows = parseManufacturerFile(noColors);
    expect(rows).toHaveLength(1);
    expect(rows[0].color_name).toBeNull();
    expect(rows[0].color_hex).toBeNull();
    expect(rows[0].name).toBe('{color_name}');
  });

  it('handles bed_temp field', () => {
    const withBed = {
      ...SAMPLE,
      filaments: [
        {
          ...SAMPLE.filaments[0],
          bed_temp: 60,
        },
      ],
    };
    const rows = parseManufacturerFile(withBed);
    expect(rows[0].bed_temp).toBe(60);
    expect(rows[0].bed_temp_min).toBe(60);
    expect(rows[0].bed_temp_max).toBe(60);
  });
});
