import { build } from './src/app.js'
import http from "http"
const DEFAULT_PORT = 4004

const run = async () => {
  const port = process.env.PORT | DEFAULT_PORT
  const app = await build();
  http.createServer(app).listen(port, () => console.log(`Server running on port ${port}`))
}

run();




