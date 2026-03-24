# Overview

The Minutes Generator Service is a Rust-based server designed to generate minutes. The server runs from the rust/ subdirectory and works alongside a Next.js development server to provide a full-featured web application.

# Prerequisites

- Git
- Rust (install via rustup)
- Node.js and npm
- ffmpeg

# Getting Started

## Clone the Repository

First, clone the repository to your local machine:
```
git clone git@github.com:johnislarry/govclerk-minutes-service.git
cd govclerk-minutes-service/rust/
```

## Install Rust

If you haven’t installed Rust yet, you can do so using rustup:
`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

Follow the on-screen instructions to complete the installation.

## Running the Server

To run the Rust server, use the following command:
`cargo run -- --clerk-test-mode --dummy-whisper`
You can also view additional options with:
`cargo run -- --help`

This will start the server on port 8000.

```
curl -X POST "http://humdinger.GovClerkMinutes.com/api/transcribe-segments" \
-H  "accept: application/json" \
-H  "Content-Type: application/json" \
-d "{\"prompt\": \"This is a conversation from the Lex Fridman podcast\",\"audio_key\":\"/Users/johnislarry/projects/govclerk-minutes-service/lexconvo2.m4a\",\"transcript_key\":\"/Users/johnislarry/projects/govclerk-minutes-service/lexconvo2diar.json\"}"
```

