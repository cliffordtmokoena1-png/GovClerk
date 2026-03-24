GovClerkMinutes is a service that allows users to upload audio or video files, and produces a transcript and meeting minutes downloadable as a Word document. Users can also upload Word, text and image files, and generate minutes from them too.

GovClerk is a SaaS product that is used by local governments to manage the meeting lifecycle end to end, including:
- agenda creation
- live meeting management
- meeting minutes creation
- hosting of documents on a public portal

Please follow these guidelines when contributing:

## Code Standards

### Required Before Each Commit

- Run `npm test` before committing any changes to ensure proper code formatting and no type errors.
- This will run prettier and rustfmt to format code, clippy to lint Rust code, and run tests.
- If you need to format code you can use `npm run format`.

### Development Flow

- Build: `npm run dev`
  - Note that this command runs both the NextJS development server and the Rust server with cargo watch. It will not terminate without being killed.
- Test: `npm test`
- Format code: `npm run format`

### React Components

React components should be default exported using `function` syntax, NOT arrow functions. Props should be defined as a `type` with the name `Props`. For example:

```ts
type Props = {
  arg1: string;
  arg2; number;
};

export default function MyComponent({ arg1, arg2 }: Props) {
  return <>{/* ... */}</>
}
```

### Variable names

Avoid single letter variable names. Usually they are only appropriate as for loop indices such as:

```ts
for (let i = 0; i < 10; i++) {
  // Single letter variable name is acceptable here
}
```

Do not use single letter variable names for for-of loops, or anywhere else. Choose a concise but descriptive name instead.

```ts
for (const item of items) {
  // `item` is an appropriate name here
}
```

### Code comments

When writing code comments, always use `//` instead of `/* ... */`.
When writing a multi-line comment, use `//` at the start of each line. For example:

```ts
// This is a multi-line comment
// that uses `//` at the start of each line.
// Do not use /* ... */ for multi-line comments.
async function myFunction() {
  // ...
}
```
