import { createFileRoute } from "@tanstack/react-router";
import { BundleDetailPage } from "../../components/BundleDetailPage";

export const Route = createFileRoute("/bundles/$slug")({
  component: BundleSlugRoute,
});

function BundleSlugRoute() {
  const { slug } = Route.useParams();
  return <BundleDetailPage slug={slug} />;
}
