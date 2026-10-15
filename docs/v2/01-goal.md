# Goal and general architecture

The goal is to build a mortgage calculator as a connected system made of four parts. Each part has one clear responsibility.

## Parts

### Front-end
What the user sees and interacts with. It collects the user's inputs and shows the results.

### API
The single entry point between the front-end and the rest of the system. It receives requests from the front-end, passes work on to the other parts and returns the answers.

### Python calculations
The part that does the actual mortgage math. It receives inputs from the API and returns the computed results.

### Supabase
The place where data is stored, such as saved calculations or user data. The API reads from it and writes to it.

## How the parts work together

```
Front-end  <-->  API  <-->  Python calculations
                  |
                  v
              Supabase
```

1. The user enters their data in the front-end.
2. The front-end sends it to the API.
3. The API asks the Python calculations to compute the result.
4. The API stores or loads data in Supabase when needed.
5. The API returns the result to the front-end, which shows it to the user.
