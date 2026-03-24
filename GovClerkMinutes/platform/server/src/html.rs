use html5ever::parse_document;
use html5ever::serialize::{serialize, SerializeOpts};
use html5ever::tendril::TendrilSink;
use markup5ever_rcdom::{Handle, NodeData, RcDom, SerializableHandle};

pub fn remove_igc_tags(html_content: &str) -> anyhow::Result<String> {
  let dom = parse_document(RcDom::default(), Default::default())
    .from_utf8()
    .read_from(&mut html_content.as_bytes())?;

  fn traverse_and_remove_img(handle: &Handle) {
    let mut children = handle.children.borrow_mut();
    children.retain(|child| {
      if let NodeData::Element { ref name, .. } = child.data {
        if &name.local == "img" {
          return false;
        }
      }
      traverse_and_remove_img(child);
      return true;
    });
  }

  traverse_and_remove_img(&dom.document);

  let mut result = Vec::new();
  serialize(
    &mut result,
    &SerializableHandle::from(dom.document.clone()),
    SerializeOpts::default(),
  )?;

  return Ok(String::from_utf8(result)?);
}
