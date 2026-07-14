import { ProtectedRoute } from "@/components/other-components/protect-route/ProtectedRoute";

const PageLoadTime = () => {
  return (
    <ProtectedRoute>
      <section className="dummy-classname">
        <h2>Page Load Time rate goes here</h2>
      </section>
    </ProtectedRoute>
  );
};

export default PageLoadTime;
