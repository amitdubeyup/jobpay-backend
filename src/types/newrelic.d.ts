// Type definitions for New Relic Node.js agent
declare module 'newrelic' {
  export function recordCustomEvent(eventType: string, attributes: Record<string, any>): void;
  export function recordMetric(name: string, value: number): void;
  export function addCustomAttributes(attributes: Record<string, string | number | boolean>): void;
  export function setTransactionName(category: string, name: string): void;
  export function noticeError(error: Error, customAttributes?: Record<string, any>): void;
  export function getCurrentTransaction(): any;
  export function startWebTransaction(url: string, handle: (...args: any[]) => any): any;
  export function startBackgroundTransaction(
    name: string,
    group: string | null,
    handle: (...args: any[]) => any,
  ): any;
  export function endTransaction(): void;
  export function createTracer(
    name: string,
    callback: (...args: any[]) => any,
  ): (...args: any[]) => any;
  export function getBrowserTimingHeader(): string;
  export function getBrowserTimingFooter(): string;
}
