type ThresholdValues = {
  100?: boolean;
  autoUpdate?: boolean | ((newThreshold: number) => number);
  branches?: number;
  functions?: number;
  lines?: number;
  perFile?: boolean;
  statements?: number;
};

type CoverageThresholds =
  | ThresholdValues
  | (ThresholdValues & {
      [glob: string]: Pick<
        ThresholdValues,
        100 | "branches" | "functions" | "lines" | "statements"
      >;
    });
    
const shouldRelaxThresholds = process.env.COVERAGE_RELAXED === "true";

export const coverageThresholds: CoverageThresholds = shouldRelaxThresholds
  ? {
      lines: 0,
      functions: 0,
      branches: 0,
      statements: 0,
      perFile: false,
    }
  : {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
      perFile: true,
      "src/lib/**": {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      "src/server/**": {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    };
