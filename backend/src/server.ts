import app from "./app";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`HRFlow backend running on http://localhost:${PORT}`);
});
