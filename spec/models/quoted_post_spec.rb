require 'spec_helper'

describe QuotedPost do
  it 'correctly extracts quotes in integration test' do
    post1 = create_post
    post2 = create_post(topic_id: post1.topic_id,
                        raw: "[quote=\"#{post1.user.username}, post: 1, topic:#{post1.topic_id}\"]\ntest\n[/quote]\nthis is a test post")

    QuotedPost.find_by(post_id: post2.id, quoted_post_id: post1.id).should_not be_nil
  end

  it 'correctly handles deltas' do
    post1 = Fabricate(:post)
    post2 = Fabricate(:post)

    post2.cooked = <<HTML
<aside class="quote" data-post="#{post1.post_number}" data-topic="#{post1.topic_id}"><div class="title"><div class="quote-controls"></div><img width="20" height="20" src="/user_avatar/meta.discourse.org/techapj/20/3281.png" class="avatar">techAPJ said:</div><blockquote><p>When the user will v</p></blockquote></aside>
HTML

    QuotedPost.create!(post_id: post2.id, quoted_post_id: 999)

    QuotedPost.extract_from(post2)
    QuotedPost.where(post_id: post2.id).count.should == 1
    QuotedPost.find_by(post_id: post2.id, quoted_post_id: post1.id).should_not be_nil

  end
end
