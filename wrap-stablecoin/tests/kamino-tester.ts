import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KaminoTester } from "../target/types/kamino_tester";

describe("kamino-tester", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.kaminoTester as Program<KaminoTester>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
