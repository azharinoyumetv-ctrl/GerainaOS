import ReadState from './ReadState';

export default function WorkspaceState({ query, children }) {
  return <>
    <ReadState loading={query.loading} error={query.error} retry={query.retry} testid="workspace-read-state" />
    {!query.loading && !query.error && children}
  </>;
}
