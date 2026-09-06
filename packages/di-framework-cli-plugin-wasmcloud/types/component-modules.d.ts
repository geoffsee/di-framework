/**
 * Ambient declarations for module specifiers that only exist inside a bundled
 * WebAssembly component: the virtual application entry injected by the build's
 * rolldown plugin, and the WASI HTTP interface provided by the component host.
 * Neither module resolves in this repository, so the adapter type-checks
 * against these stubs; they are not shipped in the tarball.
 */
declare module 'virtual:di-framework-application' {
  const application: unknown;
  export default application;
}

declare module 'wasi:http/types@0.2.12' {
  export const Fields: any;
  export const IncomingBody: any;
  export const OutgoingBody: any;
  export const OutgoingResponse: any;
  export const ResponseOutparam: any;
}
