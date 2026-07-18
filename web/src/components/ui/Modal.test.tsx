import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Declare incident">
        body
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the sheet variant with footer actions", () => {
    render(
      <Modal open onClose={() => undefined} title="Span" variant="sheet" footer={<button>Save</button>}>
        body
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <Modal open={false} onClose={() => undefined} title="x">
        body
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
