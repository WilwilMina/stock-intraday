// Unit tests for client-side validation and submission behavior. Rendering
// and interaction go through real DOM events (user-event), not fireEvent, so
// these match what an actual user does.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SymbolForm } from "./SymbolForm";

describe("SymbolForm", () => {
  it("renders a labeled input and a submit button", () => {
    render(<SymbolForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Stock symbol")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get daily data" })).toBeInTheDocument();
  });

  it("shows a validation error and never calls onSubmit for an invalid symbol", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SymbolForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Stock symbol"), "bad symbol!");
    await user.click(screen.getByRole("button", { name: "Get daily data" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter 1-15 letters, digits, or . - ^ =");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("trims whitespace and uppercases a valid symbol before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SymbolForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Stock symbol"), "  tsla  ");
    await user.click(screen.getByRole("button", { name: "Get daily data" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("TSLA");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("accepts real-world symbols with special characters (e.g. ^GSPC)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SymbolForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Stock symbol"), "^gspc");
    await user.click(screen.getByRole("button", { name: "Get daily data" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("^GSPC");
  });
});
