export type VehicleModel = {
  name: string;
  type: "Sedan" | "SUV" | "Hatchback" | "Pickup" | "Coupe" | "Convertible" | "Crossover" | "Van" | "Wagon" | "Sports" | "Electric";
};

export type VehicleMake = {
  make: string;
  models: VehicleModel[];
};

export const vehicleCatalog: VehicleMake[] = [
  {
    make: "Toyota",
    models: [
      { name: "Corolla", type: "Sedan" },
      { name: "Camry", type: "Sedan" },
      { name: "RAV4", type: "Crossover" },
      { name: "Land Cruiser", type: "SUV" },
      { name: "Hilux", type: "Pickup" },
    ],
  },
  {
    make: "Honda",
    models: [
      { name: "Civic", type: "Sedan" },
      { name: "Accord", type: "Sedan" },
      { name: "CR-V", type: "Crossover" },
      { name: "Pilot", type: "SUV" },
      { name: "HR-V", type: "Crossover" },
    ],
  },
  {
    make: "Nissan",
    models: [
      { name: "Altima", type: "Sedan" },
      { name: "Sunny", type: "Sedan" },
      { name: "Patrol", type: "SUV" },
      { name: "X-Trail", type: "Crossover" },
      { name: "Navara", type: "Pickup" },
    ],
  },
  {
    make: "Hyundai",
    models: [
      { name: "Elantra", type: "Sedan" },
      { name: "Sonata", type: "Sedan" },
      { name: "Santa Fe", type: "SUV" },
      { name: "Tucson", type: "Crossover" },
      { name: "Creta", type: "Crossover" },
    ],
  },
  {
    make: "Kia",
    models: [
      { name: "Cerato", type: "Sedan" },
      { name: "K5", type: "Sedan" },
      { name: "Sportage", type: "Crossover" },
      { name: "Sorento", type: "SUV" },
      { name: "Carnival", type: "Van" },
    ],
  },
  {
    make: "Mercedes-Benz",
    models: [
      { name: "C-Class", type: "Sedan" },
      { name: "E-Class", type: "Sedan" },
      { name: "S-Class", type: "Sedan" },
      { name: "GLE", type: "SUV" },
      { name: "G-Class", type: "SUV" },
    ],
  },
  {
    make: "BMW",
    models: [
      { name: "3 Series", type: "Sedan" },
      { name: "5 Series", type: "Sedan" },
      { name: "7 Series", type: "Sedan" },
      { name: "X5", type: "SUV" },
      { name: "X6", type: "SUV" },
    ],
  },
  {
    make: "Audi",
    models: [
      { name: "A4", type: "Sedan" },
      { name: "A6", type: "Sedan" },
      { name: "Q5", type: "Crossover" },
      { name: "Q7", type: "SUV" },
      { name: "TT", type: "Coupe" },
    ],
  },
  {
    make: "Ford",
    models: [
      { name: "Mustang", type: "Coupe" },
      { name: "Explorer", type: "SUV" },
      { name: "Expedition", type: "SUV" },
      { name: "F-150", type: "Pickup" },
      { name: "Focus", type: "Hatchback" },
    ],
  },
  {
    make: "Tesla",
    models: [
      { name: "Model 3", type: "Electric" },
      { name: "Model S", type: "Electric" },
      { name: "Model X", type: "Electric" },
      { name: "Model Y", type: "Electric" },
      { name: "Cybertruck", type: "Electric" },
    ],
  },
];
