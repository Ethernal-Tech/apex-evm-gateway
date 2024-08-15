import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Deoloy", (m) => {
  const gateway = m.contract("Gateway");

  m.call(gateway, "launch", []);

  return { gateway };
});
