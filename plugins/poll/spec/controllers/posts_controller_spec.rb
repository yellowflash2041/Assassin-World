require "spec_helper"

describe PostsController do
  let!(:user) { log_in }
  let!(:title) { "Testing Poll Plugin" }

  describe "polls" do

    it "works" do
      xhr :post, :create, { title: title, raw: "[poll]\n- A\n- B\n[/poll]" }
      expect(response).to be_success
      json = ::JSON.parse(response.body)
      expect(json["cooked"]).to match("data-poll-")
      expect(json["polls"]["poll"]).to be
    end

    it "works on any post" do
      post = Fabricate(:post)
      xhr :post, :create, { topic_id: post.topic.id, raw: "[poll]\n- A\n- B\n[/poll]" }
      expect(response).to be_success
      json = ::JSON.parse(response.body)
      expect(json["cooked"]).to match("data-poll-")
      expect(json["polls"]["poll"]).to be
    end

    it "should have different options" do
      xhr :post, :create, { title: title, raw: "[poll]\n- A\n- A[/poll]" }
      expect(response).not_to be_success
      json = ::JSON.parse(response.body)
      expect(json["errors"][0]).to eq(I18n.t("poll.default_poll_must_have_different_options"))
    end

    it "should have at least 2 options" do
      xhr :post, :create, { title: title, raw: "[poll]\n- A[/poll]" }
      expect(response).not_to be_success
      json = ::JSON.parse(response.body)
      expect(json["errors"][0]).to eq(I18n.t("poll.default_poll_must_have_at_least_2_options"))
    end

    describe "edit window" do

      describe "within the first 5 minutes" do

        let(:post_id) do
          Timecop.freeze(3.minutes.ago) do
            xhr :post, :create, { title: title, raw: "[poll]\n- A\n- B\n[/poll]" }
            ::JSON.parse(response.body)["id"]
          end
        end

        it "can be changed" do
          xhr :put, :update, { id: post_id, post: { raw: "[poll]\n- A\n- B\n- C\n[/poll]" } }
          expect(response).to be_success
          json = ::JSON.parse(response.body)
          expect(json["post"]["polls"]["poll"]["options"][2]["html"]).to eq("C")
        end

      end

      describe "after the first 5 minutes" do

        let(:post_id) do
          Timecop.freeze(6.minutes.ago) do
            xhr :post, :create, { title: title, raw: "[poll]\n- A\n- B\n[/poll]" }
            ::JSON.parse(response.body)["id"]
          end
        end

        let(:new_raw) { "[poll]\n- A\n- C[/poll]" }

        it "cannot be changed by OP" do
          xhr :put, :update, { id: post_id, post: { raw: new_raw } }
          expect(response).not_to be_success
          json = ::JSON.parse(response.body)
          expect(json["errors"][0]).to eq(I18n.t("poll.cannot_change_polls_after_5_minutes"))
        end

        it "can be edited by staff" do
          log_in_user(Fabricate(:moderator))
          xhr :put, :update, { id: post_id, post: { raw: new_raw } }
          expect(response).to be_success
          json = ::JSON.parse(response.body)
          expect(json["post"]["polls"]["poll"]["options"][1]["html"]).to eq("C")
        end

      end

    end

  end

  describe "named polls" do

    it "should have different options" do
      xhr :post, :create, { title: title, raw: "[poll name=foo]\n- A\n- A[/poll]" }
      expect(response).not_to be_success
      json = ::JSON.parse(response.body)
      expect(json["errors"][0]).to eq(I18n.t("poll.named_poll_must_have_different_options", name: "foo"))
    end

    it "should have at least 2 options" do
      xhr :post, :create, { title: title, raw: "[poll name=foo]\n- A[/poll]" }
      expect(response).not_to be_success
      json = ::JSON.parse(response.body)
      expect(json["errors"][0]).to eq(I18n.t("poll.named_poll_must_have_at_least_2_options", name: "foo"))
    end

  end

  describe "multiple polls" do

    it "works" do
      xhr :post, :create, { title: title, raw: "[poll]\n- A\n- B\n[/poll]\n[poll name=foo]\n- A\n- B\n[/poll]" }
      expect(response).to be_success
      json = ::JSON.parse(response.body)
      expect(json["cooked"]).to match("data-poll-")
      expect(json["polls"]["poll"]).to be
      expect(json["polls"]["foo"]).to be
    end

    it "should have a name" do
      xhr :post, :create, { title: title, raw: "[poll]\n- A\n- B\n[/poll]\n[poll]\n- A\n- B\n[/poll]" }
      expect(response).not_to be_success
      json = ::JSON.parse(response.body)
      expect(json["errors"][0]).to eq(I18n.t("poll.multiple_polls_without_name"))
    end

    it "should have unique name" do
      xhr :post, :create, { title: title, raw: "[poll name=foo]\n- A\n- B\n[/poll]\n[poll name=foo]\n- A\n- B\n[/poll]" }
      expect(response).not_to be_success
      json = ::JSON.parse(response.body)
      expect(json["errors"][0]).to eq(I18n.t("poll.multiple_polls_with_same_name", name: "foo"))
    end

  end

end
