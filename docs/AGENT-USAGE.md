# Agent usage

Start with `terabox_methods` because TeraBox-SIN follows the installed upstream
API dynamically. Use the direct `terabox_<method>` tool when the method is
known, or `terabox_call` for forward-compatible access to a newly added method.

Arguments are positional. Example generic calls:

```json
{"method":"checkLogin","args":[]}
{"method":"getRemoteDir","args":["/"]}
{"method":"search","args":["invoice"]}
```

For uploads, pass files using the special local-value adapters documented in
`SKILL.md`; the exact argument order remains the upstream method signature.
Use `terabox_methods` and the repository API documentation to resolve the
installed signature instead of guessing.
