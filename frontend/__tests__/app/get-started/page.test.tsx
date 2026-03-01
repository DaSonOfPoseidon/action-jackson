import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GetStartedPage from "@/app/get-started/page";

// Mock the API module
vi.mock("@/lib/api", () => ({
  submitConsultation: vi.fn(),
}));

describe("GetStartedPage", () => {
  it("renders the hero", () => {
    render(<GetStartedPage />);
    expect(screen.getByText("Get Started.")).toBeInTheDocument();
  });

  it("renders all form sections", () => {
    render(<GetStartedPage />);
    expect(screen.getByText("Contact Information")).toBeInTheDocument();
    expect(screen.getByText("Property Details")).toBeInTheDocument();
    expect(screen.getByText("Current Issues")).toBeInTheDocument();
    expect(screen.getByText("Services Interested In *")).toBeInTheDocument();
    expect(screen.getByText("Package Interest")).toBeInTheDocument();
  });

  it("renders square footage options", () => {
    render(<GetStartedPage />);
    expect(screen.getByText("Select range")).toBeInTheDocument();
  });

  it("renders current issues checkboxes", () => {
    render(<GetStartedPage />);
    expect(screen.getByText("Weak WiFi")).toBeInTheDocument();
    expect(screen.getByText("Dead zones")).toBeInTheDocument();
    expect(screen.getByText("ISP router only")).toBeInTheDocument();
  });

  it("renders service checkboxes", () => {
    render(<GetStartedPage />);
    expect(screen.getByText("Networking")).toBeInTheDocument();
    expect(screen.getByText("Smart Home")).toBeInTheDocument();
    expect(screen.getByText("Cameras")).toBeInTheDocument();
    expect(screen.getByText("Structured Wiring")).toBeInTheDocument();
  });

  it("renders package radio options", () => {
    render(<GetStartedPage />);
    expect(screen.getByText(/Foundation Network/)).toBeInTheDocument();
    expect(screen.getByText(/Smart Home Backbone/)).toBeInTheDocument();
    expect(screen.getByText(/Security \(\$999/)).toBeInTheDocument();
    expect(screen.getByText(/Performance \+ Protection/)).toBeInTheDocument();
    expect(screen.getByText("Not sure yet")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<GetStartedPage />);
    expect(screen.getByText("Submit Consultation Request")).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", () => {
    render(<GetStartedPage />);
    fireEvent.click(screen.getByText("Submit Consultation Request"));
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Square footage is required")).toBeInTheDocument();
    expect(screen.getByText("Please select at least one service")).toBeInTheDocument();
  });

  it("validates disposable email on submit", () => {
    render(<GetStartedPage />);
    const nameInput = screen.getByPlaceholderText("Your name");
    const emailInput = screen.getByPlaceholderText("you@email.com");
    fireEvent.change(nameInput, { target: { value: "John Doe" } });
    fireEvent.change(emailInput, { target: { value: "test@mailinator.com" } });
    fireEvent.click(screen.getByText("Submit Consultation Request"));
    expect(screen.getByText("Please use a non-disposable email address")).toBeInTheDocument();
  });
});
