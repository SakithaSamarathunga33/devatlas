fn main() {
    // `sqlx::migrate!` embeds the migrations, so a new file must trigger a rebuild.
    println!("cargo:rerun-if-changed=migrations");
}
