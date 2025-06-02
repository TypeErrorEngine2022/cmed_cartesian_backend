import express from "express";
import { Request, Response, NextFunction } from "express";
import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { Criteria } from "./entity/Criteria";
import { Formula } from "./entity/Formula";
import { Attribute } from "./entity/Attribute";
import cors from "cors";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import session from "express-session";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

// Authentication configuration
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Define custom interface for session data
declare module "express-session" {
  interface SessionData {
    user?: { username: string };
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Create API Router to handle /api prefix for Vercel deployment
const apiRouter = express.Router();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Important for cookies/authentication
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set CORS headers on all responses to handle preflight requests properly
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
app.use(cookieParser());
app.use(
  session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.user) {
    return next();
  }

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string };
    req.session.user = { username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Initialize database connection
AppDataSource.initialize()
  .then(async () => {
    console.log("Database connection initialized");

    // Run migrations if in production
    if (process.env.NODE_ENV === "production") {
      try {
        const migrations = await AppDataSource.runMigrations();
        console.log(`Ran ${migrations.length} migrations successfully`);
      } catch (error) {
        console.error("Error running migrations:", error);
      }
    }

    // Mount the API router with the / prefix
    app.use("/", apiRouter);

    // Start the server after database is initialized
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) =>
    console.log("Error during database initialization:", error),
  );

// Authentication Routes
apiRouter.post("/auth/login", async (req: Request, res: Response) => {
  if (!ADMIN_PASSWORD_HASH) {
    return res.status(500).json({ error: "Admin password not configured" });
  }

  const { password } = req.body;

  if (await bcrypt.compare(password, ADMIN_PASSWORD_HASH)) {
    const token = jwt.sign({ username: "admin" }, JWT_SECRET, {
      expiresIn: "24h",
    });
    req.session.user = { username: "admin" };
    res.json({ success: true, token, username: "admin" });
  } else {
    res.status(401).json({ error: "Invalid username or password" });
  }
});

apiRouter.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

apiRouter.get("/auth/verify", authenticate, (req: Request, res: Response) => {
  res.json({ authenticated: true, username: req.session.user?.username });
});

// Protected Routes - Apply authentication middleware
apiRouter.use(authenticate);

// GET /table: Retrieve table data
apiRouter.get("/table", async (req: Request, res: Response) => {
  const criteriaRepository = AppDataSource.getRepository(Criteria);
  const formulaRepository = AppDataSource.getRepository(Formula);

  const columns = await criteriaRepository.find();
  const rows = await formulaRepository.find({ relations: ["attributes"] });

  const table = {
    columns: columns.map((c: Criteria) => c.name),
    rows: rows.map((row: Formula) => ({
      name: row.name,
      annotation: row.annotation,
      attributes: Object.fromEntries(
        row.attributes.map((attr: Attribute) => [
          columns.find((c: Criteria) => c.id === attr.criteria_id)?.name,
          attr.value,
        ]),
      ),
    })),
  };
  res.json(table);
});

// POST /column: Add a new column
apiRouter.post("/column", async (req: Request, res: Response) => {
  const { column_name } = req.body;
  if (!column_name)
    return res.status(400).json({ error: "Criteria name required" });

  const criteriaRepository = AppDataSource.getRepository(Criteria);
  const formulaRepository = AppDataSource.getRepository(Formula);
  const attributeRepository = AppDataSource.getRepository(Attribute);

  const column = new Criteria();
  column.name = column_name;
  await criteriaRepository.save(column);

  const rows = await formulaRepository.find();
  for (const row of rows) {
    const attr = new Attribute();
    attr.formula_id = row.id;
    attr.criteria_id = column.id;
    attr.value = "NA";
    await attributeRepository.save(attr);
  }
  res.json({ message: "Criteria added" });
});

// POST /row: Add a new row
apiRouter.post("/row", async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Formula name required" });

  const criteriaRepository = AppDataSource.getRepository(Criteria);
  const formulaRepository = AppDataSource.getRepository(Formula);
  const attributeRepository = AppDataSource.getRepository(Attribute);

  const row = new Formula();
  row.name = name;
  await formulaRepository.save(row);

  const columns = await criteriaRepository.find();
  for (const col of columns) {
    const attr = new Attribute();
    attr.formula_id = row.id;
    attr.criteria_id = col.id;
    attr.value = "NA";
    await attributeRepository.save(attr);
  }
  res.json({ message: "Formula added" });
});

// PUT /cell: Update a cell value
apiRouter.put("/cell", async (req: Request, res: Response) => {
  const { row_id, column_name, value } = req.body;

  const criteriaRepository = AppDataSource.getRepository(Criteria);
  const formulaRepository = AppDataSource.getRepository(Formula);
  const attributeRepository = AppDataSource.getRepository(Attribute);

  const row = await formulaRepository.findOne({ where: { name: row_id } });
  const column = await criteriaRepository.findOne({
    where: { name: column_name },
  });

  if (!row || !column)
    return res.status(404).json({ error: "Formula or column not found" });

  const attr = await attributeRepository.findOne({
    where: { formula_id: row.id, criteria_id: column.id },
  });

  if (attr) {
    attr.value = value || "NA";
    await attributeRepository.save(attr);
    res.json({ message: "Cell updated" });
  } else {
    // Create new attribute if it doesn't exist
    const newAttr = new Attribute();
    newAttr.formula_id = row.id;
    newAttr.criteria_id = column.id;
    newAttr.value = value;
    await attributeRepository.save(newAttr);
    res.json({ message: "Cell created and updated" });
  }
});

// PUT /annotation: Update a row's annotation
apiRouter.put("/annotation", async (req: Request, res: Response) => {
  const { row_id, annotation } = req.body;

  const formulaRepository = AppDataSource.getRepository(Formula);

  const row = await formulaRepository.findOne({ where: { name: row_id } });

  if (!row) return res.status(404).json({ error: "Row not found" });

  row.annotation = annotation;
  await formulaRepository.save(row);

  res.json({ message: "Annotation updated" });
});

// PUT /row/:row_name: Update the row name of a row
apiRouter.put("/row/:row_name/name", async (req: Request, res: Response) => {
  const { row_name } = req.params;
  const { new_name } = req.body;
  if (!new_name) return res.status(400).json({ error: "New name required" });
  const formulaRepository = AppDataSource.getRepository(Formula);
  const row = await formulaRepository.findOne({
    where: { name: row_name },
  });
  if (!row) return res.status(404).json({ error: "Row not found" });
  row.name = new_name;
  await formulaRepository.save(row);
  res.json({ message: "Row name updated successfully" });
});

// DELETE /row/:row_name: Delete a row (formula) and its associated attributes
apiRouter.delete("/row/:row_name", async (req: Request, res: Response) => {
  const { row_name } = req.params;

  const formulaRepository = AppDataSource.getRepository(Formula);
  const attributeRepository = AppDataSource.getRepository(Attribute);

  // Find the row (formula)
  const row = await formulaRepository.findOne({
    where: { name: row_name },
  });

  if (!row) {
    return res.status(404).json({ error: "Row not found" });
  }

  try {
    // First, delete all attributes associated with this row
    await attributeRepository.delete({ formula_id: row.id });

    // Then delete the row itself
    await formulaRepository.remove(row);

    res.json({ message: "Row deleted successfully" });
  } catch (error) {
    console.error("Error deleting row:", error);
    res.status(500).json({ error: "Failed to delete row" });
  }
});

// DELETE /column: Delete a column and its associated attributes
apiRouter.delete(
  "/column/:column_name",
  async (req: Request, res: Response) => {
    const { column_name } = req.params;

    const criteriaRepository = AppDataSource.getRepository(Criteria);
    const attributeRepository = AppDataSource.getRepository(Attribute);

    // Find the column (criteria)
    const column = await criteriaRepository.findOne({
      where: { name: column_name },
    });

    if (!column) {
      return res.status(404).json({ error: "Column not found" });
    }

    try {
      // First, delete all attributes associated with this column
      await attributeRepository.delete({ criteria_id: column.id });

      // Then delete the column itself
      await criteriaRepository.remove(column);

      res.json({ message: "Column deleted successfully" });
    } catch (error) {
      console.error("Error deleting column:", error);
      res.status(500).json({ error: "Failed to delete column" });
    }
  },
);

// Export table data
apiRouter.get("/export", async (req: Request, res: Response) => {
  try {
    const criteriaRepository = AppDataSource.getRepository(Criteria);
    const formulaRepository = AppDataSource.getRepository(Formula);

    const columns = await criteriaRepository.find();
    const rows = await formulaRepository.find({ relations: ["attributes"] });

    const tableData = {
      columns: columns.map((c: Criteria) => c.name),
      rows: rows.map((row: Formula) => ({
        name: row.name,
        annotation: row.annotation,
        attributes: Object.fromEntries(
          row.attributes.map((attr: Attribute) => [
            columns.find((c: Criteria) => c.id === attr.criteria_id)?.name,
            attr.value,
          ]),
        ),
      })),
    };

    res.json({
      data: tableData,
      timestamp: new Date().toISOString(),
      version: "1.0",
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

// Import table data
apiRouter.post("/import", async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data || !data.columns || !data.rows) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    const criteriaRepository = AppDataSource.getRepository(Criteria);
    const formulaRepository = AppDataSource.getRepository(Formula);
    const attributeRepository = AppDataSource.getRepository(Attribute);

    // Get existing columns and rows
    const existingColumns = await criteriaRepository.find();
    const existingRows = await formulaRepository.find();

    // Process columns - add new ones and keep track of all columns
    const columnMap = new Map();

    // First add existing columns to the map
    for (const column of existingColumns) {
      columnMap.set(column.name, column);
    }

    // Process imported columns - add new ones or use existing ones
    for (const columnName of data.columns) {
      // Check if column already exists
      const existingColumn = existingColumns.find((c) => c.name === columnName);

      if (existingColumn) {
        // Column already exists, use it
        columnMap.set(columnName, existingColumn);
      } else {
        // Create new column
        const newColumn = new Criteria();
        newColumn.name = columnName;
        await criteriaRepository.save(newColumn);
        columnMap.set(columnName, newColumn);
      }
    }

    // Process rows and their attributes
    for (const rowData of data.rows) {
      let row: Formula;

      // Check if the row already exists
      const existingRow = await formulaRepository.findOne({
        where: { name: rowData.name },
      });

      if (existingRow) {
        // Update existing row
        existingRow.annotation = rowData.annotation || existingRow.annotation;
        row = await formulaRepository.save(existingRow);
      } else {
        // Create new row
        const newRow = new Formula();
        newRow.name = rowData.name;
        newRow.annotation = rowData.annotation || "";
        row = await formulaRepository.save(newRow);
      }

      // Process attributes for this row
      for (const [columnName, value] of Object.entries(rowData.attributes)) {
        const column = columnMap.get(columnName);
        if (column) {
          // Check if attribute already exists
          const existingAttr = await attributeRepository.findOne({
            where: {
              formula_id: row.id,
              criteria_id: column.id,
            },
          });

          if (existingAttr) {
            // Update existing attribute
            existingAttr.value = value as string;
            await attributeRepository.save(existingAttr);
          } else {
            // Create new attribute
            const newAttr = new Attribute();
            newAttr.formula_id = row.id;
            newAttr.criteria_id = column.id;
            newAttr.value = value as string;
            await attributeRepository.save(newAttr);
          }
        }
      }
    }

    res.json({ message: "Data imported successfully" });
  } catch (error) {
    console.error("Error importing data:", error);
    res.status(500).json({ error: "Failed to import data" });
  }
});
