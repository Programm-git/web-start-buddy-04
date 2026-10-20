<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Normalize supported text attachments in the browser and send image/PDF attachments through the existing streamed chat endpoint; this keeps uploads within the current conversation without a separate storage service.
- Read the project AI provider credential only inside the chat handler from the encrypted secret store; never accept browser-supplied keys or persist, expose, or log credentials or raw provider errors.
