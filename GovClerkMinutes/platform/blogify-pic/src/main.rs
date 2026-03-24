use heck::ToKebabCase;
use image::GenericImageView;
use std::fs;
use std::path::Path;
use std::process::Command;
use structopt::StructOpt;

const MAX_W: u32 = 600;
const MAX_H: u32 = 400;

#[derive(Debug, StructOpt)]
#[structopt(
    name = "blogify-pic",
    about = "Resize image to fit in a defined box and rename."
)]
struct Opt {
    /// File path to the image
    #[structopt(parse(from_os_str))]
    file: std::path::PathBuf,

    /// Description of the image
    #[structopt(long)]
    description: String,
}

fn main() {
    let opt = Opt::from_args();

    let temp_output_path = Path::new("temp.jpg");

    // Resize the image using imagemagick
    let status = Command::new("magick")
        .arg("convert")
        .arg(&opt.file)
        .arg("-resize")
        .arg(format!("{}x{}", MAX_W, MAX_H))
        .arg(&temp_output_path)
        .status()
        .expect("Failed to execute command");

    assert!(status.success(), "Image resize operation failed");

    // Open the temporary image to get its dimensions
    let img = image::open(&temp_output_path).expect("Failed to open image");

    let (width, height) = img.dimensions();

    // Construct the final output path
    let final_output_path_str = format!(
        "{}-{}x{}.jpg",
        opt.description.to_kebab_case(),
        width,
        height
    );
    let final_output_path = Path::new(&final_output_path_str);

    // Rename the temporary image to the final image
    fs::rename(&temp_output_path, &final_output_path).expect("Failed to rename image");
}
