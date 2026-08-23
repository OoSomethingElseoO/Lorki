import { Button } from "@/components/ui/button";

type AdminSearchFormProps = {
  placeholder: string;
  defaultValue?: string;
};

// A plain GET form, not a client component — submitting it just navigates
// to the same page with ?q=..., which the server component re-reads on
// the next render. No debounced input/router.push needed: search-as-you-
// submit (Enter or the button) is enough here, and it means a fresh
// search naturally drops any existing ?page=, always landing back on
// page 1 of the filtered results.
export function AdminSearchForm({ placeholder, defaultValue }: AdminSearchFormProps) {
  return (
    <form className="admin-search" method="GET">
      <input type="search" name="q" placeholder={placeholder} defaultValue={defaultValue} aria-label={placeholder} />
      <Button type="submit" variant="form">Search</Button>
      {defaultValue ? (
        <a href="?" className="admin-search__clear">
          Clear
        </a>
      ) : null}
    </form>
  );
}
