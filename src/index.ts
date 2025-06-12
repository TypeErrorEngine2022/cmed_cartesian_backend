import "reflect-metadata";
import express from "express";
import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "./data-source";
import { Criteria } from "./entity/Criteria";
import { Formula } from "./entity/Formula";
import { Attribute } from "./entity/Attribute";
import { AxisSetting } from "./entity/AxisSetting";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

const requiredEnvVars = [
  "JWT_SECRET",
  "ADMIN_PASSWORD_HASH",
  "ENV_DATABASE_URL",
  "CORS_ORIGIN",
];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

const app = express();

const corsOrigins = [];
if (process.env.CORS_ORIGIN) corsOrigins.push(process.env.CORS_ORIGIN);
corsOrigins.push("http://localhost:5173");

app.use(
  cors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Important for cookies/authentication
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

interface UserRequest extends Request {
  user?: { username: string };
}

// Authentication middleware
const authenticate = (req: UserRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? "") as {
      username: string;
    };
    req.user = { username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const apiRouter = express.Router();
app.use("/api", apiRouter);

let isDbInitialized = false;
async function initializeDb() {
  if (!isDbInitialized) {
    try {
      await AppDataSource.initialize();
      console.log("Database connection initialized");
      const entities = AppDataSource.entityMetadatas;
      console.log(
        `Registered entities: ${entities.map((e) => e.name).join(", ")}`,
      );
      if (process.env.NODE_ENV === "production") {
        const migrations = await AppDataSource.runMigrations();
        console.log(`Ran ${migrations.length} migrations successfully`);
      }
      isDbInitialized = true;
    } catch (error) {
      console.error("Error during database initialization:", error);
      throw error;
    }
  }
}

apiRouter.post("/auth/login", async (req: UserRequest, res: Response) => {
  if (!process.env.ADMIN_PASSWORD_HASH) {
    return res.status(500).json({ error: "Admin password not configured" });
  }

  const { password } = req.body;

  if (await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)) {
    const token = jwt.sign(
      { username: "admin" },
      process.env.JWT_SECRET ?? "",
      {
        expiresIn: "24h",
      },
    );
    req.user = { username: "admin" };
    res.json({ success: true, token, username: "admin" });
  } else {
    res.status(401).json({ error: "Invalid username or password" });
  }
});

apiRouter.get(
  "/auth/verify",
  authenticate,
  (req: UserRequest, res: Response) => {
    res.json({ authenticated: true, username: req.user?.username });
  },
);

// Protected Routes - Apply authentication middleware
apiRouter.use(authenticate);

// GET /table: Retrieve table data
apiRouter.get("/table", async (req: UserRequest, res: Response) => {
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
apiRouter.post("/column", async (req: UserRequest, res: Response) => {
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
apiRouter.post("/row", async (req: UserRequest, res: Response) => {
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
apiRouter.put("/cell", async (req: UserRequest, res: Response) => {
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
apiRouter.put("/annotation", async (req: UserRequest, res: Response) => {
  const { row_id, annotation } = req.body;

  const formulaRepository = AppDataSource.getRepository(Formula);

  const row = await formulaRepository.findOne({ where: { name: row_id } });

  if (!row) return res.status(404).json({ error: "Row not found" });

  row.annotation = annotation;
  await formulaRepository.save(row);

  res.json({ message: "Annotation updated" });
});

// PUT /row/:row_name: Update the row name of a row
apiRouter.put(
  "/row/:row_name/name",
  async (req: UserRequest, res: Response) => {
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
  },
);

// DELETE /row/:row_name: Delete a row (formula) and its associated attributes
apiRouter.delete("/row/:row_name", async (req: UserRequest, res: Response) => {
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
  async (req: UserRequest, res: Response) => {
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

// POST /axis-settings: Create a new axis setting
apiRouter.post("/axis-settings", async (req: UserRequest, res: Response) => {
  const { name, xNegative, xPositive, yNegative, yPositive } = req.body;

  if (!name || !xNegative || !xPositive || !yNegative || !yPositive) {
    return res.status(400).json({ error: "All axes are required" });
  }

  const criteriaRepository = AppDataSource.getRepository(Criteria);
  const axisSettingRepository = AppDataSource.getRepository(AxisSetting);

  try {
    if (await axisSettingRepository.findOne({ where: { name } })) {
      return res.status(400).json({ error: "Axis setting already exists" });
    }

    const xNegativeCriteria = await criteriaRepository.findOne({
      where: { name: xNegative },
    });
    const xPositiveCriteria = await criteriaRepository.findOne({
      where: { name: xPositive },
    });
    const yNegativeCriteria = await criteriaRepository.findOne({
      where: { name: yNegative },
    });
    const yPositiveCriteria = await criteriaRepository.findOne({
      where: { name: yPositive },
    });

    if (
      !xNegativeCriteria ||
      !xPositiveCriteria ||
      !yNegativeCriteria ||
      !yPositiveCriteria
    ) {
      return res.status(404).json({ error: "One or more criteria not found" });
    }

    const axisSetting = new AxisSetting();
    axisSetting.name = name;
    axisSetting.xNegative_criteria_id = xNegativeCriteria.id;
    axisSetting.xPositive_criteria_id = xPositiveCriteria.id;
    axisSetting.yNegative_criteria_id = yNegativeCriteria.id;
    axisSetting.yPositive_criteria_id = yPositiveCriteria.id;

    await axisSettingRepository.save(axisSetting);
    res.json({ message: "Axis settings created successfully" });
  } catch (error) {
    console.error("Error creating axis settings:", error);
    res.status(500).json({ error: "Failed to create axis settings" });
  }
});

// GET /axis-settings: Retrieve all axis settings
apiRouter.get("/axis-settings", async (req: UserRequest, res: Response) => {
  const axisSettingRepository = AppDataSource.getRepository(AxisSetting);
  try {
    const settings = await axisSettingRepository.find({
      relations: [
        "xNegativeCriteria",
        "xPositiveCriteria",
        "yNegativeCriteria",
        "yPositiveCriteria",
      ],
    });
    const transformedSettings = settings.map((setting) => ({
      id: setting.id,
      name: setting.name,
      axes: {
        xNegative: setting.xNegativeCriteria,
        xPositive: setting.xPositiveCriteria,
        yNegative: setting.yNegativeCriteria,
        yPositive: setting.yPositiveCriteria,
      },
    }));
    res.json(transformedSettings);
  } catch (error) {
    console.error("Error retrieving axis settings:", error);
    res.status(500).json({ error: "Failed to retrieve axis settings" });
  }
});

// PUT /axis-settings/:id: Update an existing axis setting
apiRouter.put("/axis-settings/:id", async (req: UserRequest, res: Response) => {
  const { id } = req.params;
  const { name, xNegative, xPositive, yNegative, yPositive } = req.body;
  if (!name || !xNegative || !xPositive || !yNegative || !yPositive) {
    return res.status(400).json({ error: "All axes are required" });
  }
  const criteriaRepository = AppDataSource.getRepository(Criteria);
  const axisSettingRepository = AppDataSource.getRepository(AxisSetting);
  try {
    const xNegativeCriteria = await criteriaRepository.findOne({
      where: { name: xNegative },
    });
    const xPositiveCriteria = await criteriaRepository.findOne({
      where: { name: xPositive },
    });
    const yNegativeCriteria = await criteriaRepository.findOne({
      where: { name: yNegative },
    });
    const yPositiveCriteria = await criteriaRepository.findOne({
      where: { name: yPositive },
    });

    if (
      !xNegativeCriteria ||
      !xPositiveCriteria ||
      !yNegativeCriteria ||
      !yPositiveCriteria
    ) {
      return res.status(404).json({ error: "One or more criteria not found" });
    }

    const setting = await axisSettingRepository.findOne({
      where: { id: parseInt(id) },
    });

    if (!setting) {
      return res.status(404).json({ error: "Axis setting not found" });
    }

    setting.name = name;
    setting.xNegative_criteria_id = xNegativeCriteria.id;
    setting.xPositive_criteria_id = xPositiveCriteria.id;
    setting.yNegative_criteria_id = yNegativeCriteria.id;
    setting.yPositive_criteria_id = yPositiveCriteria.id;

    await axisSettingRepository.save(setting);
    res.json({ message: "Axis settings updated successfully" });
  } catch (error) {
    console.error("Error updating axis settings:", error);
    res.status(500).json({ error: "Failed to update axis settings" });
  }
});

// DELETE /axis-settings/:id: Delete an axis setting
apiRouter.delete(
  "/axis-settings/:id",
  async (req: UserRequest, res: Response) => {
    const { id } = req.params;
    const axisSettingRepository = AppDataSource.getRepository(AxisSetting);
    try {
      const setting = await axisSettingRepository.findOne({
        where: { id: parseInt(id) },
      });
      if (!setting) {
        return res.status(404).json({ error: "Axis setting not found" });
      }
      await axisSettingRepository.remove(setting);
      res.json({ message: "Axis setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting axis setting:", error);
      res.status(500).json({ error: "Failed to delete axis setting" });
    }
  },
);

// Export table data
apiRouter.get("/export", async (req: UserRequest, res: Response) => {
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
apiRouter.post("/import", async (req: UserRequest, res: Response) => {
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

// Initialize DB once at module load time for serverless environments
let dbInitPromise = initializeDb();

export default async function handler(req: UserRequest, res: Response) {
  await dbInitPromise;
  return app(req, res); // Pass UserRequest to Express app
}

// for local development
if (process.env.NODE_ENV === "development") {
  const port = process.env.PORT;
  dbInitPromise.catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}
