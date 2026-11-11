import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("names the page and describes it", () => {
    render(<PageHeader title="Library" description="40 developer resources" />);

    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(screen.getByText("40 developer resources")).toBeInTheDocument();
  });

  it("renders the page's controls beside the title", () => {
    render(
      <PageHeader title="Library" description="40 developer resources">
        <button type="button">Add link</button>
      </PageHeader>,
    );

    expect(screen.getByRole("button", { name: "Add link" })).toBeInTheDocument();
  });
});
