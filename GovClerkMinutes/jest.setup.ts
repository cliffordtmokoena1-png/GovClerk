import "@testing-library/jest-dom";

// jsdom doesn’t implement scrollIntoView; stub it to a no-op for tests
if (!Element.prototype.scrollIntoView) {
  // @ts-ignore
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
