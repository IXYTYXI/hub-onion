import { createFileRoute } from "@tanstack/react-router";
import { BundleFormPage } from "../../components/BundleFormPage";

export const Route = createFileRoute("/bundles/new")({
  validateSearch: (search) => ({
    edit: typeof search.edit === "string" && search.edit.trim() ? search.edit : undefined,
  }),
  component: BundleNewRoute,
});

function BundleNewRoute() {
  const { edit } = Route.useSearch();
  return <BundleFormPage editSlug={edit} />;
}
